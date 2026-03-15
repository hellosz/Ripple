import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


async def send_password_email(to_email: str, password: str) -> bool:
    """Send initial password to newly registered user."""
    subject = f"Welcome to {settings.APP_NAME} - Your Account Password"
    body = f"""
    <h2>Welcome to {settings.APP_NAME}!</h2>
    <p>Your account has been created. Here are your login credentials:</p>
    <p><strong>Email:</strong> {to_email}</p>
    <p><strong>Password:</strong> {password}</p>
    <p>Please log in and change your password at your earliest convenience.</p>
    <br>
    <p>— The {settings.APP_NAME} Team</p>
    """

    if not settings.SMTP_HOST:
        logger.warning(f"SMTP not configured. Password for {to_email}: {password}")
        return True

    try:
        import aiosmtplib

        message = MIMEMultipart("alternative")
        message["From"] = settings.SMTP_FROM
        message["To"] = to_email
        message["Subject"] = subject
        message.attach(MIMEText(body, "html"))

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=True,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
