print("Welcome to Project Trace.")
name = input("What is your name? ")
print("Hello, " + name)
project = input("What do you want to create? ")
if project. lower() == "film":
    print("Let's create an AI film.")
else:
    print("Let's create something new.")
ideas = ["memory", "absence", "trace"]    
def show_ideas(ideas):
    for idea in ideas:
        print("-"+idea)
show_ideas(ideas)        