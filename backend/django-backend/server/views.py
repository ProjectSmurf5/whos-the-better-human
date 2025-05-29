from rest_framework.decorators import api_view
from rest_framework.response import Response

from .serializers import UserSerializer
from .serializers import UserProfileSerializer
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from .models import UserProfile

from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import get_object_or_404

@api_view(['POST'])
def login(request):
    user = get_object_or_404(User, username=request.data['username'])
    if not user.check_password(request.data['password']):
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_404_NOT_FOUND)
    token, created = Token.objects.get_or_create(user=user)
    serializer = UserSerializer(instance=user)
    return Response({"token": token.key, "user": serializer.data}, status=status.HTTP_200_OK)

@api_view(['POST'])
def signup(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        user = User.objects.get(username=request.data['username'])
        user.set_password(request.data['password'])
        user.save()
        token = Token.objects.create(user=user)
        return Response({'token': token.key, 'user': serializer.data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@authentication_classes([SessionAuthentication,TokenAuthentication])
@permission_classes([IsAuthenticated])
def test_token(request):
    # Return User 
    user = request.user
    serializer = UserSerializer(instance=user)
    return Response({"user": serializer.data}, status=status.HTTP_200_OK)

def calculate_rank(winnerRank, loserRank, k=32):
    E_a = 1 / (1 + 10 ** ((loserRank - winnerRank) / 400))
    E_b = 1 - E_a

    new_winner_rank = round(winnerRank + k * (1 - E_a))
    new_loser_rank = round(loserRank + k * (0 - E_b))
    
    
    return new_winner_rank, new_loser_rank

@api_view(['POST'])
def update_rank(request):
    winner_username = request.data.get('winner')
    loser_username = request.data.get('loser')

    winner = get_object_or_404(UserProfile, user__username=winner_username)
    loser = get_object_or_404(UserProfile, user__username=loser_username)

    new_winner_rank, new_loser_rank = calculate_rank(winner.rank, loser.rank)

    winner_diff = new_winner_rank - winner.rank
    loser_diff = new_loser_rank - loser.rank

    winner.rank = new_winner_rank
    loser.rank = new_loser_rank
    winner.save()
    loser.save()
    return Response({
        'winner': {'username': winner.user.username, 'new_rank': winner.rank, 'rank_diff': winner_diff},
        'loser': {'username': loser.user.username, 'new_rank': loser.rank, 'rank_diff': loser_diff}
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
def leaderboard(request):
    users = UserProfile.objects.all().order_by('-rank')
    serializer = UserProfileSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)
