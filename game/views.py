import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import ScoreBoard

GAMES = [
    {
        'id': 'candy', 'name': 'Candy Crush', 'emoji': '🍬',
        'description': 'Swap sweet candies to match 3 or more in a row and crush your high score!',
        'color_from': '#f59e0b', 'color_to': '#ef4444',
        'url': 'candy', 'badge': 'Hot', 'badge_color': 'green', 'difficulty': '★★★',
    },
    {
        'id': 'snake', 'name': 'Snake', 'emoji': '🐍',
        'description': 'Eat the food, grow longer, but don\'t bite yourself or the walls!',
        'color_from': '#16a34a', 'color_to': '#15803d',
        'url': 'snake', 'badge': 'Classic', 'badge_color': 'purple', 'difficulty': '★★☆',
    },
    {
        'id': 'flappy', 'name': 'Flappy Bird', 'emoji': '🐦',
        'description': 'Tap to flap through the pipes. One wrong move and it\'s game over!',
        'color_from': '#0ea5e9', 'color_to': '#6366f1',
        'url': 'flappy', 'badge': 'Addictive', 'badge_color': 'cyan', 'difficulty': '★★★',
    },
    {
        'id': 'memory', 'name': 'Memory Match', 'emoji': '🃏',
        'description': 'Flip cards and find all matching pairs before the timer runs out!',
        'color_from': '#d946ef', 'color_to': '#ec4899',
        'url': 'memory', 'badge': 'Brain', 'badge_color': 'pink', 'difficulty': '★☆☆',
    },
    {
        'id': 'whack', 'name': 'Whack-a-Mole', 'emoji': '🔨',
        'description': 'Smash the moles before they hide! Speed and reflexes are key.',
        'color_from': '#f97316', 'color_to': '#eab308',
        'url': 'whack', 'badge': 'Fun', 'badge_color': 'orange', 'difficulty': '★★☆',
    },
]

GAME_TOP = {g['id']: g for g in GAMES}


def home(request):
    tops = {g['id']: list(ScoreBoard.objects.filter(game=g['id'])[:3]) for g in GAMES}
    return render(request, 'game/home.html', {'games': GAMES, 'tops': tops})


def candy(request):  return render(request, 'game/candy.html')
def snake(request):  return render(request, 'game/snake.html')
def flappy(request): return render(request, 'game/flappy.html')
def memory(request): return render(request, 'game/memory.html')
def whack(request):  return render(request, 'game/whack.html')


def leaderboard(request):
    game_id = request.GET.get('game', 'candy')
    scores = ScoreBoard.objects.filter(game=game_id)[:20]
    current_game = GAME_TOP.get(game_id, GAMES[0])
    return render(request, 'game/leaderboard.html', {
        'scores': scores, 'games': GAMES,
        'current_game': current_game, 'game_id': game_id,
    })


@csrf_exempt
@require_POST
def save_score(request):
    try:
        data = json.loads(request.body)
        name    = data.get('name', 'Player')[:50].strip() or 'Player'
        score   = int(data.get('score', 0))
        level   = int(data.get('level', 1))
        game_id = data.get('game', 'candy')
        entry   = ScoreBoard.objects.create(player_name=name, score=score, level=level, game=game_id)
        rank    = ScoreBoard.objects.filter(game=game_id, score__gt=score).count() + 1
        return JsonResponse({'success': True, 'rank': rank, 'id': entry.id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


def scores_api(request):
    game_id = request.GET.get('game', 'candy')
    scores  = list(ScoreBoard.objects.filter(game=game_id).values('player_name', 'score', 'level', 'created_at')[:10])
    for s in scores:
        s['created_at'] = s['created_at'].strftime('%b %d, %Y')
    return JsonResponse({'scores': scores})
