from django.db import models
from django.contrib.auth.models import User

AVATAR_CHOICES = ['🎮','🦊','🐱','🐶','🦄','🐸','🎯','⭐','🔥','💎','🚀','🎸']

class UserProfile(models.Model):
    user   = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.CharField(max_length=10, default='🎮')
    wins   = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    online = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username}'s profile"

    @property
    def win_rate(self):
        total = self.wins + self.losses
        return round(self.wins / total * 100) if total else 0
