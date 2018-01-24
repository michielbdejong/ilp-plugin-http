# ilp-plugin-http-head


## Deprecated

The "ilp over http headers" protocol for which this plugin implements both a server and a client, is one of the three protocols included in Interledger version *testnet-18Q1* (the other two being [ilp over http oer](https://github.com/michielbdejong/ilp-plugin-http-oer) and [BTP/2.0](https://github.com/michielbdejong/ilp-plugin-btp)).

Within days of adding this protocol to version testnet-18Q1, we decided that it will not be included in version testnet-18Q2, and therefore, this plugin should be considered deprecated, and should not be used in newly started projects. Please use [ilp-plugin-http-oer](https://github.com/michielbdejong/ilp-plugin-http-oer) instead.

The reason for deprecating this third protocol is that, although http headers are easy to construct and debug (especially when using command-line tools like curl, and in languages where encoding and decoding OER packets is cumbersome), out of the three protocols, it is the only one that does not use OER, and therefore a connector that needs to convert between base64url and OER would be less efficient. Furthermore, we thought that it would be simpler to have only two protocols, and this third protocol doesn't add much functionality that the other two don't already provide.

## Overview

Implementation of https://github.com/interledger/rfcs/blob/de237e8b9250d83d5e9d9dec58e7aca88c887b57/0000-ilp-over-http.md

This plugin exposes the LPI v2 and aims to be compatible with the refactored ilp-connector. Its purpose is to allow Quilt
connectors to connect to Amundsen using a simple http endpoint, rather than the more complex OER-over-WebSockets interface
which we usually use between JavaScript-based connectors.

This plugin takes two options, `port` and `peerUrl`. TLS is not supported yet. See example.js for a usage example.

## Connecting to Amundsen

To connect to Amundsen using this protocol, use `btp+wss://:${token}@amundsen.ilpdemo.org:1801/head` where `${token}` is your own unique token, which you should generate randomly. You can only connect as a client (sender), not as a server (receiver).
