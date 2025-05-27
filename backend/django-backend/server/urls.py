
from django.urls import re_path
from . import views

urlpatterns = [
    re_path('login', views.login),
    re_path('signup', views.signup),
    re_path('test_token', views.test_token),
    re_path('update_rank', views.update_rank),
    re_path('leaderboard', views.leaderboardView),
]
