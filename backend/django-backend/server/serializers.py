from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile

class UserSerializer(serializers.ModelSerializer):
    rank = serializers.IntegerField(source='userprofile.rank', read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'rank']