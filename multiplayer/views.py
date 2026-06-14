from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from .models import GameRoom, ChatMessage, GAME_TYPES

GAME_META = {
    'chess':        {'name':'Chess',         'emoji':'♟️',  'min':2,'max':2,'color':'#8b5cf6'},
    'ludo':         {'name':'Ludo',          'emoji':'🎲',  'min':2,'max':4,'color':'#f97316'},
    'snake_ladder': {'name':'Snake & Ladder','emoji':'🐍',  'min':2,'max':4,'color':'#10b981'},
    'pool':         {'name':'8 Ball Pool',   'emoji':'🎱',  'min':2,'max':2,'color':'#06b6d4'},
    'carrom':       {'name':'Carrom Board',  'emoji':'🪙',  'min':2,'max':4,'color':'#f59e0b'},
}

@login_required
def lobby(request):
    rooms = GameRoom.objects.filter(is_active=True).prefetch_related('players','host__profile').order_by('-created_at')[:30]
    if request.method == 'POST':
        game_type = request.POST.get('game_type')
        name = request.POST.get('name', f"{request.user.username}'s Room").strip()[:60]
        if game_type in dict(GAME_TYPES):
            meta = GAME_META[game_type]
            room = GameRoom.objects.create(
                game_type=game_type, name=name,
                host=request.user, max_players=meta['max']
            )
            room.players.add(request.user)
            return redirect('game_room', pk=str(room.id))
    return render(request, 'multiplayer/lobby.html', {
        'rooms': rooms, 'game_meta': GAME_META,
        'game_types': GAME_TYPES,
    })

@login_required
def game_room(request, pk):
    room = get_object_or_404(GameRoom, pk=pk, is_active=True)
    if request.user not in room.players.all():
        if room.players.count() < room.max_players:
            room.players.add(request.user)
        else:
            return redirect('multi_lobby')
    messages = room.messages.select_related('user__profile').order_by('-timestamp')[:50]
    meta = GAME_META.get(room.game_type, {})
    players_qs  = list(room.players.select_related('profile').all())
    player_list = sorted(players_qs, key=lambda p: (0 if p == room.host else 1, p.id))
    player_index = next((i for i,p in enumerate(player_list) if p == request.user), 0)
    return render(request, f'multiplayer/room_{room.game_type}.html', {
        'room': room, 'meta': meta,
        'messages': reversed(list(messages)),
        'player_list': player_list,
        'player_index': player_index,
        'is_host': room.host == request.user,
    })

SUPER_ADMINS = {'vamsi', 'zayron'}

@login_required
def delete_room(request, pk):
    if request.user.username in SUPER_ADMINS:
        room = get_object_or_404(GameRoom, pk=pk)
    else:
        room = get_object_or_404(GameRoom, pk=pk, host=request.user)
    room.is_active = False
    room.save()
    return redirect('multi_lobby')

@login_required
def leave_room(request, pk):
    room = get_object_or_404(GameRoom, pk=pk)
    room.players.remove(request.user)
    if room.players.count() == 0 or room.host == request.user:
        room.is_active = False
        room.save()
    return redirect('multi_lobby')

@login_required
def online_users(request):
    from accounts.models import UserProfile
    profiles = UserProfile.objects.filter(online=True).select_related('user')
    return JsonResponse({'users': [
        {'username': p.user.username, 'avatar': p.avatar} for p in profiles
    ]})
