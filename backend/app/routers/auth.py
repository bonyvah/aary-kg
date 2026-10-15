from fastapi import APIRouter, Request, Response

from app.config import get_settings
from app.deps import COOKIE_NAME, CurrentUser, Session
from app.netutil import client_ip
from app.schemas.user import LoginIn, ManagedUser
from app.security import create_token
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ManagedUser, response_model_by_alias=True)
async def login(body: LoginIn, request: Request, response: Response, session: Session) -> ManagedUser:
    user = await service.authenticate(session, body.login, body.password, client_ip(request))
    s = get_settings()
    response.set_cookie(
        COOKIE_NAME,
        create_token(str(user.id), user.token_version),
        max_age=s.jwt_ttl_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=s.cookie_secure,
        path="/",
    )
    return ManagedUser.model_validate(user)


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=ManagedUser, response_model_by_alias=True)
async def me(user: CurrentUser) -> ManagedUser:
    return ManagedUser.model_validate(user)
