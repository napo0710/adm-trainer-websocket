'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');
const WebSocket = require('ws');
const {request} = require('express');
const app = express();
app.use(express.static(path.join(__dirname, '/public')));
const server = createServer(app);
const wss = new WebSocket.Server({ server });


//Game vars
let game= {
    'channels': {
        //Default test server
        '34' : {
            'atcs': [],
            'players': [],
            'obstacles': []
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
        case 'atc':
            //Check if the channel exists
            if(game.channels[data.channel]){
                //Store the uuid and channel to future use
                client.uuid=data.uuid;
                client.channel=data.channel;

                //Now add the ATC to the channel
                game.channels[data.channel].atcs.push({
                    'uuid':data.uuid,
                    'role':data.role,
                    'player_name':data.player_name
                });

                //Let's confirm the data by returning the list of players
                client.send(JSON.stringify({
                    request: 'game_update',
                    players: game.channels[data.channel].players
                }));
            }
        break;
        case 'register':
            //Check if the channel exists
            if(game.channels[data.channel]){
                //Store the uuid and channel to future use
                client.uuid=data.uuid;
                client.channel=data.channel;

                //Now register the player by adding the uuid and role to the channel, if role is pilot
                if(data.role=='pilot'){
                    game.channels[data.channel].players.push({
                        'uuid':data.uuid,
                        'role':data.role,
                        'player_name':data.player_name
                    });
                }


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
            //Now return to the new client the list of players
            client.send(JSON.stringify({
                request: 'game_update',
                players: game.channels[data.channel].players
            }));

            //Also send the list of obstacles
            client.send(JSON.stringify({
                request: 'obstacle_update',
                obstacles: game.channels[data.channel].obstacles
            }));
        break;

        case 'obstacle':
            //Add or remove the obstacle from the channel according to the status
            if(data.status){
                game.channels[data.channel].obstacles.push({
                    'obstacle':data.obstacle
                });
            }else{
                //Remove the obstacle from the channel
                game.channels[data.channel].obstacles.forEach(function(obstacle,index){
                    if(obstacle.obstacle==data.obstacle){
                        game.channels[data.channel].obstacles.splice(index,1);
                    }
                });
            }

            //In this case, we need to send the information to all clients if belong to the same channel
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN && client.channel==data.channel) {
                    //Send the player array to the client
                    client.send(JSON.stringify({
                        request: 'obstacle_update',
                        obstacles: game.channels[data.channel].obstacles
                    }));
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
                    //Send the player array to the client
                    game.channels[data.channel].players.forEach(function(player){
                        if(player.uuid==data.uuid){
                            client.send(JSON.stringify({
                                request: 'game_update',
                                players: [player]
                            }));
                        }
                    });
                }
            });
    }
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