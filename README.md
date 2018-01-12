# ilp-plugin-http

Implementation of https://github.com/interledger/rfcs/blob/de237e8b9250d83d5e9d9dec58e7aca88c887b57/0000-ilp-over-http.md

This plugin exposes the LPI v2 and aims to be compatible with the refactored ilp-connector. Its purpose is to allow Quilt
connectors to connect to Amundsen using a simple http endpoint, rather than the more complex OER-over-WebSockets interface
which we usually use between JavaScript-based connectors.

This plugin takes two options, `port` and `peerUrl`. TLS is not supported yet. See example.js for a usage example.
