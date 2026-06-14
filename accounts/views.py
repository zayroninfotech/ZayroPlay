from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import UserProfile, AVATAR_CHOICES


def register(request):
    if request.user.is_authenticated:
        return redirect('multi_lobby')
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email    = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        password2= request.POST.get('password2', '')
        avatar   = request.POST.get('avatar', '🎮')
        if not username or not password:
            messages.error(request, 'Username and password are required.')
        elif password != password2:
            messages.error(request, 'Passwords do not match.')
        elif User.objects.filter(username=username).exists():
            messages.error(request, 'Username already taken.')
        else:
            user = User.objects.create_user(username=username, email=email, password=password)
            UserProfile.objects.create(user=user, avatar=avatar)
            login(request, user)
            return redirect('multi_lobby')
    return render(request, 'accounts/register.html', {'avatars': AVATAR_CHOICES})


def login_view(request):
    if request.user.is_authenticated:
        return redirect('multi_lobby')
    if request.method == 'POST':
        username = request.POST.get('username', '')
        password = request.POST.get('password', '')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect(request.GET.get('next', 'multi_lobby'))
        messages.error(request, 'Invalid username or password.')
    return render(request, 'accounts/login.html')


def logout_view(request):
    logout(request)
    return redirect('home')


@login_required
def profile(request):
    profile = request.user.profile
    if request.method == 'POST':
        avatar = request.POST.get('avatar', profile.avatar)
        profile.avatar = avatar
        profile.save()
        messages.success(request, 'Profile updated!')
    return render(request, 'accounts/profile.html', {
        'profile': profile, 'avatars': AVATAR_CHOICES
    })
