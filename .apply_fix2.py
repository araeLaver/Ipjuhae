import io

path = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/ui/src/components/IssueDocumentsSection.test.tsx"
src = io.open(path, encoding="utf-8").read()

old_helper = '''async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
'''
new_helper = '''async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// A fixed number of `flush()` calls only settles react-query when each stage of
// the query lifecycle happens to land inside the ticks we spent. That held on an
// idle machine but not during a full parallel suite run, where the extra
// scheduling latency left the component still rendering its loading state.
// Waiting on the rendered condition instead of on a tick count keeps these cases
// deterministic regardless of machine load.
async function flushUntil(condition: () => boolean, maxTicks = 50) {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    await flush();
    if (condition()) return;
  }
}
'''
assert old_helper in src
src = src.replace(old_helper, new_helper, 1)

old1 = '''    await flush();
    await flush();

    expect(container.textContent).not.toContain("Restored plan body");

    const revisionButtons = Array.from(container.querySelectorAll("button"));'''
new1 = '''    await flushUntil(() => container.textContent?.includes("rev 3") ?? false);

    expect(container.textContent).not.toContain("Restored plan body");

    const revisionButtons = Array.from(container.querySelectorAll("button"));'''
assert old1 in src
src = src.replace(old1, new1, 1)

old2 = '''    await flush();
    await flush();

    expect(container.textContent).toContain("Loaded plan body");'''
new2 = '''    await flushUntil(() => container.textContent?.includes("Loaded plan body") ?? false);

    expect(container.textContent).toContain("Loaded plan body");'''
assert old2 in src
src = src.replace(old2, new2, 1)

io.open(path, "w", encoding="utf-8").write(src)
print("written", path)
