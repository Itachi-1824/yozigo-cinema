import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function run(file, args, cwd) {
  const result = spawnSync(file, args, { encoding: "utf8", shell: false, cwd });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr}`);
  return result.stdout.trim();
}

function duration(file) {
  const value = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid video duration: ${file}`);
  return value;
}

function time(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  return `${String(Math.floor(milliseconds / 3600000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")},${String(milliseconds % 1000).padStart(3, "0")}`;
}

export async function renderDemo([main, left, right, admin], outDir) {
  outDir = path.resolve(outDir);
  await mkdir(outDir, { recursive: true });
  const mainTime = duration(main);
  const raceTime = Math.min(duration(left), duration(right));
  const adminTime = duration(admin);
  const total = mainTime + raceTime + adminTime;
  if (total < 180 || total > 300) throw new Error(`Demo must be 3–5 minutes; footage is ${total.toFixed(2)} seconds`);
  const captions = [
    [0, mainTime, "Film discovery / Seat selection / Timed hold / Demo payment / Booking history"],
    [mainTime, mainTime + raceTime, "Two independent customers / One seat / Only one hold succeeds"],
    [mainTime + raceTime, total, "Studio / Booking details / Film management / Showtime overlap validation"],
  ].map(([start, end, label], i) => `${i + 1}\n${time(start)} --> ${time(end)}\n${label}\n`).join("\n");
  await writeFile(path.join(outDir, "captions.srt"), captions);
  const segments = path.join(outDir, "segments.mp4");
  run("ffmpeg", ["-y", "-i", main, "-i", left, "-i", right, "-i", admin, "-filter_complex",
    "[0:v]scale=1920:1080,setsar=1,fps=30,setpts=PTS-STARTPTS,format=yuv420p[m];[1:v]scale=960:540,setsar=1,fps=30,setpts=PTS-STARTPTS[l];[2:v]scale=960:540,setsar=1,fps=30,setpts=PTS-STARTPTS[r];[l][r]hstack=inputs=2:shortest=1,pad=1920:1080:0:270:black[race];[3:v]scale=1920:1080,setsar=1,fps=30,setpts=PTS-STARTPTS,format=yuv420p[a];[m][race][a]concat=n=3:v=1:a=0[v]",
    "-map", "[v]", "-c:v", "libx264", "-preset", "fast", "-crf", "20", segments]);
  const final = path.join(outDir, "frame-demo.mp4");
  run("ffmpeg", ["-y", "-i", segments, "-vf", "subtitles=captions.srt:force_style='FontSize=16,MarginV=28'", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", final], outDir);
  const result = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height,pix_fmt", "-of", "json", final]));
  const stream = result.streams[0];
  if (stream.codec_name !== "h264" || stream.width !== 1920 || stream.height !== 1080 || stream.pix_fmt !== "yuv420p" || Math.abs(Number(result.format.duration) - total) > 1) throw new Error("Rendered demo failed verification");
  console.log(JSON.stringify({ file: final, ...result.format, ...stream }));
  return final;
}
