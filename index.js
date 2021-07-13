const fetch = require('node-fetch')
const ftpd = require('ftpd')
const Mode = require('stat-mode')
const { Readable, PassThrough } = require('stream')

const DEFAULT_PORT = 6669
const DEFAULT_HOST = `127.0.0.1:${DEFAULT_PORT}`
const DEFAULT_GATEWAY = 'http://localhost:4973'

module.exports = {
  createServer
}

async function createServer ({
  port = DEFAULT_PORT,
  gateway = DEFAULT_GATEWAY,
  ...opts
} = {}) {
  const fs = {
    unlink,
    readdir,
    mkdir,
    open,
    close,
    rmdir,
    rename,
    stat,
    createWriteStream,
    createReadStream
  }

  const seen = new Set()

  function normalizePath (path) {
    const split = path.split('/')
    if (split.length === 2 && !path.endsWith('/')) return path + '/'
    return path
  }

  function trackDomain (path) {
    const split = path.split('/')
    const domain = split[1]

    if (domain) seen.add(domain)
  }

  async function stat (path, cb) {
    console.log('stat', path, cb)
    path = normalizePath(path)
    const split = path.split('/')
    try {
      if (split.length <= 2) {
        const stat = {
          mode: 0,
          mtime: new Date(),
          ctime: new Date(),
          atime: new Date(),
          size: 1,
          isDirectory: () => true,
          isFile: () => false
        }

        const mode = new Mode(stat)
        mode.isDirectory(true)
        mode.owner.read = true
        mode.group.read = true
        mode.others.read = true
        mode.owner.write = true
        mode.group.write = true
        mode.others.write = true

        return cb(null, stat)
      }

      const url = `${gateway}/hyper${path}?noResolve`

      const response = await fetch(url, {
        method: 'HEAD'
      })

      await response.text()

      if (!response.ok) throw new Error('Not Found')

      trackDomain(path)

      const size = parseInt(response.headers.get('content-length'), 10) || 0
      const mtime = new Date(response.headers.get('last-modified'))
      const ctime = mtime
      const atime = mtime
      const isDirectory = () => response.headers.get('x-is-directory') === 'true'
      const isFile = () => !isDirectory()
      const writable = response.headers.get('allow').includes('PUT')

      // Seems only these are absolutely necessary
      const stat = {
        writable,
        mode: 0,
        mtime,
        ctime,
        atime,
        size,
        isDirectory,
        isFile
      }

      const mode = new Mode(stat)
      mode.isDirectory(isDirectory())
      mode.isFile(isFile())
      mode.owner.read = true
      mode.group.read = true
      mode.others.read = true
      mode.owner.write = writable
      mode.group.write = writable
      mode.others.write = writable

      cb(null, stat)
    } catch (err) {
      cb(err)
    }
  }

  function unlink (path, cb) {
    console.log('unlink', path, cb)
    cb(new Error('Not implemented'))
  }
  function rename (fromPath, toPath, cb) {
    console.log('rename', fromPath, toPath, cb)
    cb(new Error('Not implemented'))
  }

  async function readdir (path, cb) {
    path = normalizePath(path)

    console.log('readdir', path, cb)

    if (path === '/') {
      const files = [...seen]
      console.log('Root', files)
      return cb(null, files)
    }

    const url = `${gateway}/hyper${path}?noResolve`

    try {
      const response = await fetch(url)
      const files = await response.json()
      trackDomain(path)
      console.log('files', files)
      cb(null, files)
    } catch (err) {
      console.log(err)
      cb(err)
    }
  }
  function mkdir (path, cb) {
    console.log('mkdir', path, cb)
    cb(new Error('Not implemented'))
  }
  function rmdir (path, cb) {
    console.log('rmdir', path, cb)
    cb(new Error('Not implemented'))
  }

  function createReadStream (path, { fd } = {}) {
    console.log('createReadStream', path, fd)
    const stream = new PassThrough()
    if (fd) {
      const { path } = fd
      return createReadStream(path)
    } else {
      const url = `${gateway}/hyper${path}?noResolve`
      fetch(url).then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text())
        }
        const responseStream = Readable.from(response.body)
        responseStream.pipe(stream)
      }).catch((e) => {
        stream.destroy(e)
      })
    }

    return stream
  }
  function createWriteStream (path, { fd } = {}) {
    console.log('createWriteStream', path, fd)
    const stream = new PassThrough()
    if (fd) {
      const { path } = fd
      return createReadStream(path)
    } else {
      process.nextTick(() => {
        const url = `${gateway}/hyper${path}`
        fetch(url, {
          method: 'PUT',
          body: stream
        }).then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text()
            console.log(errorText)
            throw new Error(errorText)
          }
          await response.text()
        }).catch((e) => {
          stream.destroy(e)
        })
        stream.emit('open')
      })
    }

    return stream
  }

  // Create an FD for readstream and writestream
  function open (path, mode, cb) {
    console.log('open', path, cb)
    stat(path, (err, stat) => {
      if (err) return cb(err)
      const isDirectory = stat.isDirectory()
      if (isDirectory) return cb(new Error('Cannot open directory'))
      if (mode.includes('w') && !stat.writable) return cb(new Error('Cannot write'))
      const fd = { path, mode }
      cb(null, fd)
    })
  }
  function close (fd, cb) {
    console.log('close', fd, cb)
    cb(null)
  }

  const ftp = new ftpd.FtpServer(DEFAULT_HOST, {
    getInitialCwd: function () {
      return '/'
    },
    getRoot: function () {
      return '/'
    }
  })

  ftp.on('client:connected', (connection) => {
    connection.on('command:user', (user, success) => {
      console.log('User')
      success(fs)
    })
    connection.on('command:pass', (pass, success) => {
      console.log({ pass })
      success('anonymous', fs)
    })
  })

  await new Promise((resolve, reject) => {
    ftp.listen(port, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })

  console.log('Listening', port)

  ftp.debugging = 4

  return ftp
}
