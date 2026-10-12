# Local infrastructure

The root `compose.yaml` is the executable local configuration. This directory is reserved for
future project-scoped support files. Compose deliberately omits `container_name`, binds database
ports to loopback only, and uses named volumes. It must not interact with the older external
container named `postgres`.
