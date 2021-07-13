# hyper-gateway-ftp
Hypercore Protocol exposed as an FTP server which can be mounted as a network drive.

Note: You need to have a [hyper-gateway](https://github.com/RangerMauve/hyper-gateway) server running somewhere that's accessible by the ftp server. Running both on localhost is the easiest method.

## CLI

```
npm i -g hyper-gateway-ftp
```

```
hper-gateway-ftp run
```

```
hyper-gateway-ftp <command>

Commands:
  hyper-gateway-ftp run  Run the ftp server

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]

hyper-gateway-ftp run

Run the ftp server

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
  --port     The port to run the server on                       [default: 4387]
  --host     The hostname to listen on                    [default: "127.0.0.1"]
  --gateway  The URL of the hyperdrive-gateway[default: "http://localhost:4973"]
```

## Compiling single executibles

If you aren't interested in using node.js on the target system, you can create executibles that compile the JS code along with Node.js into a single file you can upload to a server.

This can be done with `npm run build` which will then produce Linux/Mac/Windows binaries in the `dist` folder.

A PR adding a Github Action to auto-upload these artefacts would be very much appreciated. :)

## How it works:

- Set up a [hyper-gateway](https://github.com/RangerMauve/hyper-gateway) instance.
- Run the `hyper-gateway-ftp` CLI with the gateway URL.
- Use the FTP server URL to mount it as a network drive
- The drive will show recently opened Hyperdrives as folders in the root
- You can open a new drive by specifying a directory name like `/blog.mauve.moe/`
- If you use a drive `name` like `/example/`, you can save files and delete files
- If you use a drive that's readonly, you can only read directories and files
- Since it's using Hyperdrive, data is loaded on the fly into the gateway.
