# ==============================================================================
# FILE: masters/utils.py
# ==============================================================================

from .models import MasterAuditLog

def get_client_ip(request):
    """Extract client IP from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def get_user_agent(request):
    """Extract user agent from request"""
    return request.META.get('HTTP_USER_AGENT', '')[:255]

def log_master_change(master, action, user, request, old_data=None, new_data=None):
    """
    Create an audit log entry for master changes
    """
    MasterAuditLog.objects.create(
        master=master,
        action=action,
        old_data=old_data,
        new_data=new_data,
        changed_by=user,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )