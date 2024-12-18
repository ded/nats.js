# NATS JetStream setup guide to run in local

## How to publish and consume messages in your service

## Nats credentials to connect to the Nats cluster in GCP

- Look for `Nats Credentials for dev` in 1password

## Publish a meesage

- Utilize the `@durolabs/nats.js` library to publish messages to the NATS server.
- Full example here in plm-items: https://github.com/duronext/phoenix/blob/main/apps/plm-items/src/events/item-event.ts. you'll see how to publish a message and what interface to use to publish a message.
- Conventions:
  - Messages go to the `EVENTS` stream which is created by default as part of the NATS server setup.
  - Each message should have a subject that matches the convention `[entity].>` while entity is the name of the entity that is being published in a plural form.
    - Example: `items.created`, `items.updated`,`users.updated`, `changeorders.updated`.
    - If a subject is not found in the `EVENTS` stream, it will be created automatically.

## Consume a message

- Utilize the `@durolabs/nats.js` library to consume messages from the NATS server.
- Full example here in eventsourcing: https://github.com/duronext/phoenix/blob/main/apps/eventsourcing/src/consumer/consumer.service.ts
- Conventions:
  - Each consumer should have a unique name that matches the convention `[service name].consumer`
  - Service name should be in the environment variable `SERVICE_NAME`
  - If a consumer is not found in the `EVENTS` stream, it will be created automatically.

## Usage (if you want to run it locally - you can skip this step)

### Install NATS CLI

```bash
brew install nats-io/nats-tools/nats
```

### Run NATS server with JetStream enabled

```yaml
# docker-compose.yml
services:
  nats:
    image: nats:latest
    command: "-js"
    restart: always
    ports:
      - "4222:4222"
      - "8222:8222"
```

```bash
docker-compose up -d
```

### create a stream

#### Note: stream `EVENTS` is created as part of the NATS server setup. This will be used by default by the consumer.

run below and answer no to all questions

```bash
nats stream add EVENTS --subjects "items.>, users.>" --replicas 1 --storage file --retention limits --ack --discard old --dupe-window 2m --max-msgs=-1 --max-msgs-per-subject=-1 --max-bytes=-1 --max-age=0 --max-msg-size=-1 --max-consumers=-1
```

### Install @durolabs/nats.js

```bash
npm i @durolabs/nats.js
```

### Steps:

- create a producer and run it on a port of your choice

- publish messages

- create a consumer in a different terminal

- consume a message example

You should see the message in the consumer terminal as soon as you publish a message to the producer.

see a working example here: https://github.com/durolabs/nats-js-express-example

_Happy event sourcing!_
