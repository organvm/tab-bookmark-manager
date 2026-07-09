const http = require('http');
const { Duplex } = require('stream');

class MockSocket extends Duplex {
  constructor() {
    super();
    this.chunks = [];
    this.encrypted = false;
    this.remoteAddress = '127.0.0.1';
    this.remotePort = 0;
    this.localAddress = '127.0.0.1';
    this.localPort = 0;
  }

  _read() {}

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  cork() {}

  uncork() {}

  setTimeout() {
    return this;
  }

  setNoDelay() {
    return this;
  }

  setKeepAlive() {
    return this;
  }

  destroySoon() {
    this.destroy();
  }
}

class InProcessRequest {
  constructor(app, method, path) {
    this.app = app;
    this.method = method;
    this.path = path;
    this.headers = {};
    this.bodyPayload = undefined;
    this.queryParams = [];
    this.expectations = [];
    this.promise = null;
  }

  set(field, value) {
    if (typeof field === 'object') {
      Object.entries(field).forEach(([key, headerValue]) => {
        this.headers[key.toLowerCase()] = String(headerValue);
      });
      return this;
    }

    this.headers[field.toLowerCase()] = String(value);
    return this;
  }

  send(payload) {
    this.bodyPayload = payload;
    return this;
  }

  query(params) {
    if (typeof params === 'string') {
      this.queryParams.push(params);
      return this;
    }

    Object.entries(params || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(item => this.queryParams.push([key, item]));
      } else if (value !== undefined) {
        this.queryParams.push([key, value]);
      }
    });
    return this;
  }

  expect(expected, expectedBody) {
    this.expectations.push([expected, expectedBody]);
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  catch(reject) {
    return this.execute().catch(reject);
  }

  finally(callback) {
    return this.execute().finally(callback);
  }

  async execute() {
    if (!this.promise) {
      this.promise = invokeApp(this.app, {
        method: this.method,
        path: this.buildPath(),
        headers: this.headers,
        bodyPayload: this.bodyPayload,
      }).then(response => {
        this.applyExpectations(response);
        return response;
      });
    }

    return this.promise;
  }

  buildPath() {
    const url = new URL(this.path, 'http://127.0.0.1');

    this.queryParams.forEach(param => {
      if (typeof param === 'string') {
        new URLSearchParams(param).forEach((value, key) => {
          url.searchParams.append(key, value);
        });
      } else {
        url.searchParams.append(param[0], String(param[1]));
      }
    });

    return `${url.pathname}${url.search}`;
  }

  applyExpectations(response) {
    this.expectations.forEach(([expected, expectedBody]) => {
      if (typeof expected === 'number' && response.statusCode !== expected) {
        throw new Error(`expected ${expected} response status, got ${response.statusCode}`);
      }

      if (typeof expected === 'function') {
        expected(response);
      }

      if (expectedBody !== undefined) {
        const expectedText = typeof expectedBody === 'string'
          ? expectedBody
          : JSON.stringify(expectedBody);
        if (response.text !== expectedText) {
          throw new Error(`expected response body ${expectedText}, got ${response.text}`);
        }
      }
    });
  }
}

function request(app) {
  return {
    get: path => new InProcessRequest(app, 'GET', path),
    post: path => new InProcessRequest(app, 'POST', path),
    put: path => new InProcessRequest(app, 'PUT', path),
    patch: path => new InProcessRequest(app, 'PATCH', path),
    delete: path => new InProcessRequest(app, 'DELETE', path),
  };
}

function invokeApp(app, options) {
  return new Promise((resolve, reject) => {
    const headers = {
      host: '127.0.0.1',
      ...options.headers,
    };

    const socket = new MockSocket();
    const req = new http.IncomingMessage(socket);
    const res = new http.ServerResponse(req);

    req.method = options.method;
    req.url = options.path;
    req.headers = headers;
    req.rawHeaders = rawHeadersFrom(headers);
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.socket = socket;
    req.connection = socket;
    req.body = options.bodyPayload === undefined ? {} : options.bodyPayload;
    req.rawBody = options.bodyPayload === undefined ? '' : JSON.stringify(options.bodyPayload);

    res.assignSocket(socket);

    res.on('finish', () => {
      try {
        resolve(parseResponse(res, socket));
      } catch (error) {
        reject(error);
      }
    });
    res.on('error', reject);
    req.on('error', reject);

    try {
      app(req, res);
      process.nextTick(() => {
        req.push(null);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function rawHeadersFrom(headers) {
  return Object.entries(headers).flatMap(([key, value]) => [key, value]);
}

function parseResponse(res, socket) {
  const raw = Buffer.concat(socket.chunks).toString('utf8');
  const separator = '\r\n\r\n';
  const separatorIndex = raw.indexOf(separator);
  const rawHeaders = separatorIndex === -1 ? raw : raw.slice(0, separatorIndex);
  const text = separatorIndex === -1 ? '' : raw.slice(separatorIndex + separator.length);
  const headers = {};

  rawHeaders.split('\r\n').slice(1).forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      return;
    }

    const key = line.slice(0, colonIndex).toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  });

  return {
    status: res.statusCode,
    statusCode: res.statusCode,
    headers,
    text,
    body: parseBody(text, headers['content-type']),
  };
}

function parseBody(text, contentType = '') {
  if (!text) {
    return {};
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  return text;
}

module.exports = request;
