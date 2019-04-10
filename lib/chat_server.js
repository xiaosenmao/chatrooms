const socketio = require('socket.io');
let io;
let guestNumber = 1;
const nickNames = {};
const nameUsed = [];
const currentRoom = {};

exports.listen = function(server) {
    // 启动Socket.IO 服务器， 允许它搭载在已有的HTTP服务器之上
    io = socketio.listen(server);
    io.set('log leve', 1);
    
    // 定义每个用户连接的处理逻辑
    io.sockets.on('connection', function(socket){
        // 在用户连接上来时赋予其一个访客名
        guestNumber = assignGeustName(socket, guestNumber, nickNames, nameUsed);
        
        // 在用户连接上来时候把他放到聊天室Lobby里面
        joinRoom(socket, 'Lobby');

        // 处理用户的消息，更名，聊天室的创建和变更
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, nameUsed);
        handleRoomJoining(socket);

        // 用户发出请求时， 向其提供已经被占用的聊天室的列表
        socket.on('rooms', function(){
            socket.emit('rooms', io.sockets.manager.rooms)
        })

        // 定义用户断开连接后的清楚逻辑
        handleClientDisconnection(socket, nickNames, nameUsed);
    });
};

// 1. 分配用户昵称
function assignGeustName(socket, guestNumber, nickNames, nameUsed) {
    const name = 'Guest' + guestNumber;  // 生成新的昵称
    nickNames[socket.id] = name;  // 把用户昵称跟客户端连接ID关联上
    socket.emit('nameResult', {success: true, name: name});  // 让用户知道他们的昵称
    nameUsed.push(name);  // 存放已被占用的昵称
    return guestNumber + 1;
}

// 2. 进入聊天室
function joinRoom(socket, room) {
    socket.join(room);  // 让用户进入房间
    currentRoom[socket.id] = room;  // 记录当前房间
    socket.emit('joinResult', {room: room});  // 让用户知道他们进入了新的房间
    socket.broadcast.to(room).emit('message', {  // 让房间里的其他用户知道有新用户进入了房间
        text: nickNames[socket.id] + ' has joined ' + room + ': '
    });

    const usersInRoom = io.sockets.clients(room);
    if (userInRoom.length > 1) {  // 如果不止一个用户在这个房间里，汇总下都是谁
        const usersInRoomSummary = 'Users currently in ' + room + ': ';
        for (let index in usersInRoom) {
            const userSocketId = usersInRoom[index].id;
            if (userSocketId !== socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ', ';
                }
                usersInRoomSummary += nickNames[userSocketId];
            }
        }
        usersInRoomSummary += '.';
        socket.emit('message', {text: usersInRoomSummary})  // 将房间里其他用户的汇总发送给这个用户
    }
}

// 3. 更名请求处理逻辑
function handleNameChangeAttempts(socket, nickNames, nameUsed) {
    socket.on('nameAttempt', function(name) {
        if (name.indexOf('Guest') === 0 ) {
            socket.emit('nameResult', {success: false, message: 'Name cannot begin with "Guest".'});
        } else {
            if (nameUsed.indexOf(name) == -1) {  // 昵称没有被注册
                const previousName = nickNames[socket.id];
                const previousNameIndex = nameUsed.indexOf(previousName);
                nameUsed.push(name);
                nickNames[socket.id] = name;
                delete nameUsed[previousNameIndex];  // 删掉之前用的昵称，让其他用户可以使用 
                socket.emit('nameResult', {success: true, name: name});
                socket.broadcast.to(currentRoom[socket.id]).emit('message', {text: previousName + ' is now known as ' + name + '.'});
            } else {
                // 如果昵称已经被占用，给客户端发送错误消息
                socket.emit('nameResult', {
                    success: false,
                    message: 'That name is already in use.'
                });
            }

        }
    })
}

// 4. 发送聊天信息
function handleMessageBroadcasting(socket) {
    socket.on('message', function(message) {
        socket.broadcast.to(message.room).emit('message', {
            text: nickNames[socket.id] + ': ' + message.text
        });
    });
}

// 5. 创建房间
function handleRoomJoining(socket) {
    socket.on('join', function(roon) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    });
}

// 6. 用户断开连接
function handleClientDisconnection(socket) {
    socket.on('disconnect', function() {
        const nameIndex = nameUsed.indexOf(nickNames[socket.id]);
        delete nameUsed[nameIndex];
        delete nickNames[socket.id]
    })
}