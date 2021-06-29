# hyper-gateway-ftp
Hypercore Protocol exposed as an FTP server which can be mounted as a network drive.

## How it works:

- Set up a [hyper-gateway](https://github.com/RangerMauve/hyper-gateway) instance.
- Run the `hyper-gateway-ftp` CLI with the gateway URL.
- Use the FTP server URL to mount it as a network drive
- The drive will show recently opened Hyperdrives as folders in the root
- You can open a new drive by specifying a directory name like `/blog.mauve.moe/`
- If you use a drive `name` like `/example/`, you can save files and delete files
- If you use a drive that's readonly, you can only read directories and files
- Since it's using Hyperdrive, data is loaded on the fly into the gateway.
