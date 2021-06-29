#!/usr/bin/env node
const yargs = require('yargs')

function runOptions (yargs) {
  return yargs
    .option('port', {
      describe: 'The port to run the server on',
      default: 6669
    })
    .option('gateway', {
      describe: 'The URL of the hyperdrive-gateway',
      default: 'http://localhost:4973'
    })
}

async function runServer (args) {
  const { createServer } = require('./')

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
