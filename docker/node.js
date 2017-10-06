var http = require('http')
var hash = require('object-hash')
var url = require('url')

http.createServer(function (request, response) {
  let url_parts = url.parse(request.url, true)

  // Chrome requests the favicon. Rather than crash, just return nothing.
  if(url_parts.query === undefined || url_parts.query.obj_to_hash === undefined) {
    return
  }

  let o = ""
  try {
    o = JSON.parse(url_parts.query.obj_to_hash)
  } catch(e) {
    console.warn('Provided obj_to_hash is not valid JSON; defaulting to using it as a string')
    o = url_parts.query.obj_to_hash
  }
  
  // TODO: accept options from parameters
  response.end(hash(o, {respectType: true, unorderedArrays: true, unorderedSets: true}))
}).listen(8081)

// Console will print the message
console.log('Server running at http://127.0.0.1:8081/')
