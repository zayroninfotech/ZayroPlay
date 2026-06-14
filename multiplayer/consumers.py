import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id  = self.scope['url_route']['kwargs']['room_id']
        self.group    = f'room_{self.room_id}'
        self.user     = self.scope['user']
        if not self.user.is_authenticated:
            await self.close(); return
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self.set_online(True)
        avatar = await self.get_avatar()
        await self.channel_layer.group_send(self.group, {
            'type': 'player_event',
            'event': 'join',
            'username': self.user.username,
            'avatar': avatar,
        })

    async def disconnect(self, code):
        await self.set_online(False)
        avatar = await self.get_avatar()
        await self.channel_layer.group_send(self.group, {
            'type': 'player_event',
            'event': 'leave',
            'username': self.user.username,
            'avatar': avatar,
        })
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')
        avatar   = await self.get_avatar()

        if msg_type == 'chat':
            content = data.get('content', '').strip()[:500]
            if content:
                await self.save_chat(content)
                await self.channel_layer.group_send(self.group, {
                    'type': 'chat_message',
                    'username': self.user.username,
                    'avatar': avatar,
                    'content': content,
                    'timestamp': timezone.now().strftime('%H:%M'),
                })

        elif msg_type == 'game_move':
            await self.channel_layer.group_send(self.group, {
                'type': 'game_state',
                'username': self.user.username,
                'move': data.get('move', {}),
                'state': data.get('state', {}),
            })

        elif msg_type == 'game_event':
            await self.channel_layer.group_send(self.group, {
                'type': 'game_event_broadcast',
                'username': self.user.username,
                'event': data.get('event', ''),
                'payload': data.get('payload', {}),
            })

    # ── Handlers ──────────────────────────────────────────────────────────
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({'type': 'chat', **event}))

    async def game_state(self, event):
        await self.send(text_data=json.dumps({'type': 'game_move', **event}))

    async def game_event_broadcast(self, event):
        await self.send(text_data=json.dumps({'type': 'game_event', **event}))

    async def player_event(self, event):
        await self.send(text_data=json.dumps({'type': 'player_event', **event}))

    # ── DB helpers ─────────────────────────────────────────────────────────
    @database_sync_to_async
    def get_avatar(self):
        try:   return self.user.profile.avatar
        except:return '🎮'

    @database_sync_to_async
    def set_online(self, status):
        try:
            self.user.profile.online = status
            self.user.profile.save(update_fields=['online'])
        except: pass

    @database_sync_to_async
    def save_chat(self, content):
        from .models import ChatMessage, GameRoom
        try:
            room = GameRoom.objects.get(id=self.room_id)
            ChatMessage.objects.create(room=room, user=self.user, content=content)
        except: pass
