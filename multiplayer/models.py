import json, uuid
from django.db import models
from django.contrib.auth.models import User

GAME_TYPES = [
    ('chess',        'Chess'),
    ('ludo',         'Ludo'),
    ('snake_ladder', 'Snake & Ladder'),
    ('pool',         '8 Ball Pool'),
    ('carrom',       'Carrom Board'),
]

class GameRoom(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    game_type  = models.CharField(max_length=20, choices=GAME_TYPES)
    name       = models.CharField(max_length=60)
    host       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_rooms')
    players    = models.ManyToManyField(User, related_name='joined_rooms', blank=True)
    max_players= models.IntegerField(default=2)
    is_active  = models.BooleanField(default=True)
    state      = models.TextField(default='{}')
    created_at = models.DateTimeField(auto_now_add=True)

    def get_state(self):
        return json.loads(self.state)

    def set_state(self, data):
        self.state = json.dumps(data)
        self.save(update_fields=['state'])

    def __str__(self):
        return f"{self.game_type}: {self.name}"


class ChatMessage(models.Model):
    room      = models.ForeignKey(GameRoom, on_delete=models.CASCADE, related_name='messages')
    user      = models.ForeignKey(User, on_delete=models.CASCADE)
    content   = models.TextField(max_length=500)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"[{self.room}] {self.user}: {self.content[:30]}"
