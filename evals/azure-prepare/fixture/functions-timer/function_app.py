import azure.functions as func
import logging
import datetime

app = func.FunctionApp()

@app.timer_trigger(schedule="0 */5 * * * *", arg_name="timer",
                   run_on_startup=False)
def cleanup_job(timer: func.TimerRequest) -> None:
    logging.info("Timer job ran at %s", datetime.datetime.utcnow().isoformat())
