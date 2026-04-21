from routers import auth, users  # ve diğerleri
app.include_router(auth.router)
app.include_router(users.router)