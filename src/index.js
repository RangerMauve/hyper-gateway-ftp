const fetch = require('node-fetch')
const ftpd = require('ftpd')
const Mode = require('stat-mode')
const { Readable, PassThrough } = require('stream')

const DEFAULT_PORT = 4387 // HFTP on a phone dialpad
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_GATEWAY = 'http://localhost:4973'
module.exports = {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_GATEWAY,
  createServer
}

async function createServer ({
  port = DEFAULT_PORT,
  gateway = DEFAULT_GATEWAY,
  host = DEFAULT_HOST,
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

  async function unlink (path, cb) {
    path = normalizePath(path)
    const url = `${gateway}/hyper${path}?noResolve`
    try {
      const response = await fetch(url, { method: 'DELETE' })
      if (!response.ok) throw new Error('Not Found')
    } catch (e) {
      cb(e, null)
    }
  }
  function rename (fromPath, toPath, cb) {
    cb(new Error('Not implemented'))
  }

  async function readdir (path, cb) {
    path = normalizePath(path)

    if (path === '/') {
      const files = [...seen]
      return cb(null, files)
    }

    const url = `${gateway}/hyper${path}?noResolve`

    try {
      const response = await fetch(url)
      const files = await response.json()
      trackDomain(path)
      cb(null, files)
    } catch (err) {
      cb(err)
    }
  }
  async function mkdir (path, cb) {
    path = normalizePath(path)
    if (!path.endsWith('/')) path = path + '/'
    const url = `${gateway}/hyper${path}?noResolve`
    try {
      const response = await fetch(url, { method: 'PUT' })
      if (!response.ok) throw new Error(await response.text())
    } catch (e) {
      cb(e, null)
    }
  }
  async function rmdir (path, cb) {
    path = normalizePath(path)
    const url = `${gateway}/hyper${path}?noResolve`
    try {
      const response = await fetch(url, { method: 'DELETE' })
      if (!response.ok) throw new Error('Not Found')
    } catch (e) {
      cb(e, null)
    }
  }

  function createReadStream (path, { fd } = {}) {
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
    const stream = new PassThrough()
    if (fd) {
      const { path } = fd
      return createWriteStream(path)
    } else {
      process.nextTick(() => {
        const url = `${gateway}/hyper${path}`
        fetch(url, {
          method: 'PUT',
          body: stream
        }).then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text()
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
    cb(null)
  }

  const ftp = new ftpd.FtpServer(host + ':' + port, {
    getInitialCwd: function () {
      return '/'
    },
    getRoot: function () {
      return '/'
    }
  })

  ftp.on('client:connected', (connection) => {
    connection.on('command:user', (user, success) => {
      success(fs)
    })
    connection.on('command:pass', (pass, success) => {
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

  ftp.debugging = 0

  return ftp
}
