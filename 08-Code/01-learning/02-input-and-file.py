traces = []
def add_trace():
    memory = input("Leave a trace: ")
    if memory == "":
        print("nothing remains.")
    else:
        traces.append(memory)  
        print("Trace recorded: " + memory)  
add_trace()
add_trace()
add_trace()
print("all traces:")
for trace in traces:
    print("-"+ trace)
with open("05-Assets/traces.txt", "w") as file:
    for trace in traces:
        file.write(trace + "\n")

print("Traces saved.")    