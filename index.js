'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');
const WebSocket = require('ws');
const app = express();
app.use(express.static(path.join(__dirname, '/public')));
const server = createServer(app);
const wss = new WebSocket.Server({ server });


//Game vars
let game= {
    'channels': {
        //Default test server
        '34' : {
            'players': []
        }
    }
};

//While connection is open
wss.on('connection', function (client) {

  //Method retrieves message from client
  client.on('message', (data) => {
    //Transform the data to JSON
    data = JSON.parse(data);

    //Do not accept data if channel or uuid is not set
    if(!data.channel || !data.uuid){
        return;
    }

    //Let's use a switch to execute a function according to the request
    switch (data.request) {
        case 'register':
            //Check if the channel exists
            if(game.channels[data.channel]){
                //Store the uuid and channel to future use
                client.uuid=data.uuid;
                client.channel=data.channel;

                //Now register the player by adding the uuid and role to the channel
                game.channels[data.channel].players.push({
                    'uuid':data.uuid,
                    'role':data.role
                });

                //Let's confirm the data
                client.send(JSON.stringify({result:'success',msg:'admtrainer_client_registered'}));
            }else{
                //If not exists, send the response
                client.send(JSON.stringify({result:'error',msg:'admtrainer_client_channel_not_found'}));
            }
          break;

        //When the pilot starts the game
        case 'start':
            //Update the information in the channel
            game.channels[data.channel].players.forEach(function(player){
                if(player.uuid==data.uuid){
                    player.registration=data.registration;
                    player.color=data.color;
                }
            });
        break;

        case 'move':
            //Update the information in the channel (px,py,speed,hdg,alt)
            game.channels[data.channel].players.forEach(function(player){
                if(player.uuid==data.uuid){
                    player.px=data.px;
                    player.py=data.py;
                    player.speed=data.speed;
                    player.hdg=data.hdg;
                    player.alt=data.alt;
                }
            });

            //In this case, we need to send the information to all clients if belong to the same channel
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN && client.channel==data.channel && client.uuid!=data.uuid) {
                    //Send the whole array
                    client.send(JSON.stringify({
                        request: 'game_update',
                        board: game.channels[data.channel]
                    }))
                }
            });
    }

      //Show the status
      console.log(game.channels[data.channel]);
  })

  //Method notifies when client disconnects
  client.on('close', () => {
      //Remove the player from the channel
      game.channels[client.channel].players.forEach(function(player,index){
          if(player.uuid==client.uuid){
              game.channels[client.channel].players.splice(index,1);
          }
      });
  })
});

server.listen(8080, function () {
  console.log('Listening on http://0.0.0.0:8080');
});