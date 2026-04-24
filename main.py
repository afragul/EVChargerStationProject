import app

from routers import auth, chargers,issue_reports, payments, reservations, stations, users,vehicles

app.include_router(auth.router)
app.include_router(chargers.router)
app.include_router(issue_reports.router)
app.include_router(payments.router)
app.include_router(reservations.router)
app.include_router(stations.router)
app.include_router(users.router)
app.include_router(vehicles.router)
