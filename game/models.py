from django.db import models

GAME_CHOICES = [
    ('candy',  'Candy Crush'),
    ('snake',  'Snake'),
    ('flappy', 'Flappy Bird'),
    ('memory', 'Memory Match'),
    ('whack',  'Whack-a-Mole'),
]


class ScoreBoard(models.Model):
    player_name = models.CharField(max_length=50)
    score       = models.IntegerField(default=0)
    level       = models.IntegerField(default=1)
    game        = models.CharField(max_length=20, choices=GAME_CHOICES, default='candy')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-score']

    def __str__(self):
        return f"[{self.game}] {self.player_name} — {self.score}"
