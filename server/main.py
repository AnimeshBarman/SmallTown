from fastapi import FastAPI


app = FastAPI(title="Welcome to SmallTown Api", version="1.0.0")


@app.get("/")
def root():
    return {"Message": "Welcome to SmallTown Api"}