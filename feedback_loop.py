# feedback_loop.py
def feedback_loop(success):
    if success:
        print("\n🎉 Task completed successfully!")
        return True
    else:
        user_feedback = input("\n❌ Task failed. Do you want the agent to retry? (yes/no): ").strip().lower()
        return user_feedback != 'no'
