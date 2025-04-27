# agent.py
from planner import generate_plan
from executor import execute_code
from feedback_loop import feedback_loop

def main():
    print("👩‍💻 Welcome to the Local AI Agent!")
    task = input("📌 What task do you want the agent to perform?\n> ")

    while True:
        plan = generate_plan(task)
        print("\n🧠 Plan Generated:\n", plan)

        approve = input("\n✅ Approve and run this plan? (yes/no): ").lower()
        if approve != 'yes':
            task = input("🔁 Enter revised task: ")
            continue

        success = execute_code(plan)
        if feedback_loop(success):
            break
        else:
            print("\n🔁 Retrying... Re-refining the plan.")

if __name__ == '__main__':
    main()
