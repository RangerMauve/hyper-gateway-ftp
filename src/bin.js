#!/usr/bin/env node
const yargs = require('yargs')
const {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_GATEWAY,
  createServer
} = require('./')

function runOptions (yargs) {
  return yargs
    .option('port', {
      describe: 'The port to run the server on',
      default: DEFAULT_PORT
    })
    .option('host', {
      describe: 'The hostname to listen on',
      default: DEFAULT_HOST
    })
    .option('gateway', {
      describe: 'The URL of the hyperdrive-gateway',
      default: DEFAULT_GATEWAY
    })
}

async function runServer (args) {
  const server = await createServer(args)

  process.on('SIGINT', () => {
    try {
      server.close()
    } catch (e) {
      console.error('Unable to close gracefully')
      console.error(e)
      process.exit(1)
    }
  })
}

yargs
  .scriptName('hyper-gateway-ftp')
  .showHelpOnFail(true)
  .demandCommand()
  .command('run', 'Run the ftp server', runOptions, runServer)
  .help()
  .parse(process.argv.slice(2))
