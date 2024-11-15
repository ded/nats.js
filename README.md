# NATS JetStream setup guide to run in local

Guide for setting up NATS JetStream streams and consumers with recommended patterns and commands.

## Prerequisites

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

run below and answer no to all questions

```bash
nats stream add EVENTS --subjects "items.>, users.>" --replicas 1 --storage file --retention limits --ack --discard old --dupe-window 2m --max-msgs=-1 --max-msgs-per-subject=-1 --max-bytes=-1 --max-age=0 --max-msg-size=-1 --max-consumers=-1
```

## Usage

### Install @durolabs/nats.js

```bash
npm i @durolabs/nats.js
```

### Steps:

create a producer and run it on a port of your choice

publish messages

create a consumer in a different terminal

consume a message example

You should see the message in the consumer terminal as soon as you publish a message to the producer.

see a working example here: https://github.com/durolabs/nats-js-express-example

_Happy event sourcing!_
