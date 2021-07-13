const test = require('tape')
const { Client } = require('basic-ftp')
const { PassThrough, Readable } = require('stream')
const crypto = require('crypto')
const getPort = require('get-port')

const { createServer } = require('./')

test('Create server and load a file', async (t) => {
  const host = '127.0.0.1'
  const port = await getPort()

  const server = await createServer({ host, port })
  const client = new Client()
  try {
    await client.access({
      host,
      port,
      user: 'anonymous',
      password: 'password',
      secure: false
    })

    client.ftp.verbose = false

    const files = await client.list('blog.mauve.moe/')
    t.ok(files.length, 'Listed some files')

    const directories = await client.list('/')

    t.equal(directories.length, 1, 'List recently viewed sites in root')

    const indexContentStream = new PassThrough()
    const downloadProgress = client.downloadTo(indexContentStream, 'blog.mauve.moe/index.html')

    const [indexContent] = await Promise.all([
      readContents(indexContentStream),
      downloadProgress
    ])

    t.ok(indexContent, 'Got index html content')

    const exampleText = 'Hello World? ' + crypto.randomBytes(2).toString('hex')

    const exampleStream = Readable.from(toGenerator(exampleText))
    await client.uploadFrom(exampleStream, '/example/example.txt')

    t.pass('Able to upload')

    const exampleContentStream = new PassThrough()
    const exampleDownloadProgress = client.downloadTo(exampleContentStream, 'example/example.txt')

    const [exampleContent] = await Promise.all([
      readContents(exampleContentStream),
      exampleDownloadProgress
    ])

    t.equal(exampleContent, exampleText, 'File got successfully uploaded')
  } finally {
    server.close()
    client.close()
  }
})

async function readContents (stream) {
  let content = ''
  for await (const chunk of stream) {
    content += chunk.toString('utf8')
  }

  return content
}

async function * toGenerator (contents) {
  yield Buffer.from(contents)
}
