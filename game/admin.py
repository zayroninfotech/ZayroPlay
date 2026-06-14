from django.contrib import admin
from .models import ScoreBoard


@admin.register(ScoreBoard)
class ScoreBoardAdmin(admin.ModelAdmin):
    list_display = ('player_name', 'score', 'level', 'created_at')
    ordering = ('-score',)
    search_fields = ('player_name',)
