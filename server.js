const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const cache = {};

function send404(response) {
    response.writeHead(404, {'Content-type': 'text/plain'});
    response.write('Error 404: resource not found.');
    response.end();
}

function sendFile(response, filePath, fileContents) {
    response.writeHead(
        200,
        {'content-type': mime.getType(path.basename(filePath))}
    );
    response.end(fileContents);
}

// 提供静态文件服务
function serveStatic(response, cache, absPath) {
    if (cache[absPath]) { // 检查文件是否缓存在内存中
        sendFile(response, absPath, cache[absPath]);  // 从内存中返回文件
    } else {
        fs.exists(absPath, function(exists) {  // 检查文件是否存在于硬盘上
            if (exists) {
                fs.readFile(absPath, function(err, data) {
                    if (err) {
                        send404(response);
                    } else {
                        cache[absPath] = data;
                        sendFile(response, absPath, data);  // 从硬盘中读取文件并返回
                    }
                });
            } else {
                send404(response);
            }
        });
    }
}

const server = http.createServer((request, response) => {
    let filePath = false;

    if (request.url == '/') {
        filePath = 'public/index.html';
    } else {
        filePath = 'public' + request.url;
    }

    const absPath = './' + filePath;
    console.log(absPath);
    serveStatic(response, cache, absPath); // 返回静态文件
});

server.listen(3000, () => {
    console.log('Server listening on port 3000.');
});

const chatServer = reqiure('./lib/chat_server');
chatServer.listen(server);