# ==============================================================================
# FILE: masters/urls.py
# ==============================================================================
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MasterViewSet

router = DefaultRouter()
router.register(r'', MasterViewSet, basename='master')

app_name = 'masters'

urlpatterns = [
    path('', include(router.urls)),
]
