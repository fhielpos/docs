# docs - User documentation for Giant Swarm

Our Documentation is based on Markdown and HTML content and generated using [HUGO](http://gohugo.io/), a static site generator written in Go.

## Where's the content?

Content is in this public repo: [giantswarm/docs-content](https://github.com/giantswarm/docs-content).

## Development setup

To have the up-to-date content in the local directory, execute `make build` first. This will check out the docs-content repository and copy it's content to the correct locations. Do this whenever content has changed.

For a quick preview, with `hugo` installed (`brew install hugo`), run `./run-dev.sh` and access `http://localhost:1313/`.

The full documentation application consists of several components. The best way to run them all locally is using `fig`. To start the application locally, including proxy and search functions, use

```
fig up
```

Look at the `fig.yml` file for details on what happens here.

## Building Docker images

For testing purposes, the image can be built using `make build`.

For a new production deployment, the latest image is created and pushed using `builder`.

```
builder release <patch|minor|major>
```

## Deploying content updates

1. Create and push a new docs image using builder, as decribed above

2. Stop and start the `content-master` component:

```
SWARM_CLUSTER_ID=cluster-01.giantswarm.io swarm stop swarmdocs/content-master
SWARM_CLUSTER_ID=cluster-01.giantswarm.io swarm start swarmdocs/content-master
```

This will update the search index and replace the first of the content servers.

3. Stop and start the `content-slave` component:

```
SWARM_CLUSTER_ID=cluster-01.giantswarm.io swarm stop swarmdocs/content-slave
SWARM_CLUSTER_ID=cluster-01.giantswarm.io swarm start swarmdocs/content-slave
```

This will replace the second of the content servers.

## About writing for the documentation

There is more information available in the [Wiki](https://git.giantswarm.io/giantswarm/docs/wikis/home).
