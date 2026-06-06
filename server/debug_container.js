import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function debugContainers() {
    try {
        const containers = await docker.listContainers({ all: true });
        console.log(`Found ${containers.length} containers.`);

        for (const containerInfo of containers) {
            const container = docker.getContainer(containerInfo.Id);
            const info = await container.inspect();

            console.log('---------------------------------------------------');
            console.log(`Name: ${info.Name}`);
            console.log(`ID: ${info.Id}`);
            console.log(`Image (from list): ${containerInfo.Image}`);
            console.log(`ImageID (from list): ${containerInfo.ImageID}`);
            console.log(`Config.Image: ${info.Config.Image}`);
            console.log(`Image (from inspect): ${info.Image}`);

            // Try to get image details
            try {
                const image = docker.getImage(info.Image);
                const imageInfo = await image.inspect();
                console.log(`Local Image RepoTags: ${JSON.stringify(imageInfo.RepoTags)}`);
                console.log(`Local Image RepoDigests: ${JSON.stringify(imageInfo.RepoDigests)}`);
            } catch (err) {
                console.log(`Failed to inspect local image: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

debugContainers();
