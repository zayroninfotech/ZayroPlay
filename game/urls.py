from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
path('play/candy/',   views.candy,  name='candy'),
    path('play/snake/',   views.snake,  name='snake'),
    path('play/flappy/',  views.flappy, name='flappy'),
    path('play/memory/',  views.memory, name='memory'),
    path('play/whack/',   views.whack,  name='whack'),
    path('leaderboard/',  views.leaderboard, name='leaderboard'),
    path('api/save-score/', views.save_score, name='save_score'),
    path('api/scores/',     views.scores_api, name='scores_api'),
]
