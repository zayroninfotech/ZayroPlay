from django.urls import path
from . import views

urlpatterns = [
    path('',              views.lobby,      name='multi_lobby'),
    path('room/<uuid:pk>/',views.game_room, name='game_room'),
    path('room/<uuid:pk>/leave/', views.leave_room, name='leave_room'),
    path('room/<uuid:pk>/delete/', views.delete_room, name='delete_room'),
    path('api/online/',   views.online_users, name='online_users'),
]
