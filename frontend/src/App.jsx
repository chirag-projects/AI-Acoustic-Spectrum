import { useEffect, useRef, useState } from "react";

function App() {

  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  const runningRef = useRef(false);

  const [
    geminiAnalysis,
    setGeminiAnalysis
  ] = useState("");

  const [status, setStatus] =
    useState("Waiting");

  const [running, setRunning] =
    useState(false);

  async function startAnalyzer() {

    try {

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;

      const audioCtx =
        new (window.AudioContext ||
          window.webkitAudioContext)();

      audioCtxRef.current = audioCtx;

      const analyser =
        audioCtx.createAnalyser();

      analyser.fftSize = 2048;

      analyser.smoothingTimeConstant = 0.75;

      analyserRef.current = analyser;

      const source =
        audioCtx.createMediaStreamSource(
          stream
        );

      source.connect(analyser);

      runningRef.current = true;

      setRunning(true);

      const track =
        stream.getAudioTracks()[0];

      setStatus(
        `Using: ${track.label}`
      );

      draw();

    } catch (err) {

      console.error(err);

      setStatus(
        "Microphone failed"
      );
    }

    socketRef.current =
      new WebSocket(
        "ws://127.0.0.1:8000/ws/audio/"
      );

    socketRef.current.onmessage =
      (event) => {

        const response =
          JSON.parse(event.data);

        console.log(
          "Gemini:",
          response
        );

        if (
          response.type ===
          "analysis"
        ) {

          setGeminiAnalysis(
            response.analysis
          );
        }
      };

    socketRef.current.onopen = () => {

      console.log(
        "WebSocket Connected"
      );
    };

    socketRef.current.onclose = () => {

      console.log(
        "WebSocket Closed"
      );
    };
  }

  function stopAnalyzer() {

    runningRef.current = false;

    setRunning(false);

    cancelAnimationFrame(
      animationRef.current
    );

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((t) => t.stop());
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }

    const canvas = canvasRef.current;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    setStatus("Stopped");

    if (socketRef.current) {

      socketRef.current.close();
    }
  }

  function toggle() {

    if (runningRef.current) {
      stopAnalyzer();
    } else {
      startAnalyzer();
    }
  }

  function draw() {

    if (!runningRef.current) return;

    animationRef.current =
      requestAnimationFrame(draw);

    const canvas = canvasRef.current;

    const ctx = canvas.getContext("2d");

    const analyser = analyserRef.current;

    // Canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 420;

    const width = canvas.width;
    const height = canvas.height;

    // FFT data
    const bufferLength =
      analyser.frequencyBinCount;

    const timeData =
      new Uint8Array(analyser.fftSize);

    analyser.getByteTimeDomainData(timeData);

    const dataArray =
      new Uint8Array(bufferLength);

    analyser.getByteFrequencyData(
      dataArray
    );

    const sampleRate =
      audioCtxRef.current.sampleRate;

    const binSize =
      sampleRate / analyser.fftSize;

    let weightedSum = 0;

    let magnitudeSum = 0;

    let max = 0;

    let index = 0;

    // Find strongest FFT bin
    for (let i = 0; i < bufferLength; i++) {

      const frequency = i * binSize;

      weightedSum +=
        frequency * dataArray[i];

      magnitudeSum +=
        dataArray[i];

      if (dataArray[i] > max) {

        max = dataArray[i];

        index = i;
      }
    }

    const spectralCentroid =
      magnitudeSum > 0
        ? weightedSum / magnitudeSum
        : 0;

    const peakFrequency =
      index * sampleRate /
      analyser.fftSize;

    // Energy accumulators
    let bass = 0;

    let mid = 0;

    let treble = 0;

    // Analyze FFT bins
    for (let i = 0; i < bufferLength; i++) {

      const freq = i * binSize;

      const value = dataArray[i];

      if (freq >= 20 && freq < 250) {
        bass += value;
      }

      else if (
        freq >= 250 &&
        freq < 4000
      ) {
        mid += value;
      }

      else if (freq >= 4000) {
        treble += value;
      }
    }

    // ZCR
    let zeroCrossings = 0;

    for (
      let i = 1;
      i < timeData.length;
      i++
    ) {

      const prev =
        timeData[i - 1] - 128;

      const curr =
        timeData[i] - 128;

      if (
        (prev >= 0 && curr < 0) ||
        (prev < 0 && curr >= 0)
      ) {

        zeroCrossings++;
      }
    }

    const zcr =
      zeroCrossings / timeData.length;

    // RMS
    let sumSquares = 0;

    for (
      let i = 0;
      i < timeData.length;
      i++
    ) {

      const sample =
        (timeData[i] - 128) / 128;

      sumSquares +=
        sample * sample;
    }

    const rms =
      Math.sqrt(
        sumSquares / timeData.length
      );

    // Send data to backend
    if (
      socketRef.current &&
      socketRef.current.readyState === 1
    ) {

      socketRef.current.send(

        JSON.stringify({

          peakFrequency:
            peakFrequency,

          spectralCentroid:
            spectralCentroid,

          zcr:
            zcr,

          rms:
            rms,

          bass:
            bass,

          mid:
            mid,

          treble:
            treble,

          timestamp:
            Date.now(),
        })
      );
    }

    // Background
    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        height
      );

    gradient.addColorStop(
      0,
      "#07111f"
    );

    gradient.addColorStop(
      1,
      "#02050b"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    // Grid
    ctx.strokeStyle =
      "rgba(255,255,255,0.05)";

    ctx.lineWidth = 1;

    for (let i = 0; i < height; i += 40) {

      ctx.beginPath();

      ctx.moveTo(0, i);

      ctx.lineTo(width, i);

      ctx.stroke();
    }

    // Spectrum Bars
    const barWidth =
      width / bufferLength;

    for (
      let i = 0;
      i < bufferLength;
      i++
    ) {

      const value = dataArray[i];

      const barHeight =
        (value / 255) * height;

      const hue =
        (i / bufferLength) * 320;

      ctx.fillStyle =
        `hsl(${hue}, 90%, 60%)`;

      ctx.shadowBlur = 12;

      ctx.shadowColor =
        `hsl(${hue}, 90%, 60%)`;

      ctx.fillRect(
        i * barWidth,
        height - barHeight,
        barWidth,
        barHeight
      );
    }

    ctx.shadowBlur = 0;

    // Top Glass Panel
    ctx.fillStyle =
      "rgba(8, 15, 30, 0.75)";

    ctx.fillRect(
      15,
      15,
      420,
      185
    );

    ctx.strokeStyle =
      "rgba(255,255,255,0.08)";

    ctx.strokeRect(
      15,
      15,
      420,
      185
    );

    // Title
    ctx.fillStyle = "#ffffff";

    ctx.font =
      "bold 22px Poppins";

    ctx.fillText(
      "Real-Time Audio Metrics",
      30,
      45
    );

    // Metrics
    ctx.font =
      "17px Poppins";

    ctx.fillStyle = "#00E5FF";

    ctx.fillText(
      `Peak Frequency : ${Math.round(
        peakFrequency
      )} Hz`,
      30,
      80
    );

    ctx.fillStyle = "#00FFA3";

    ctx.fillText(
      `Bass Energy : ${Math.round(
        bass
      )}`,
      30,
      110
    );

    ctx.fillStyle = "#FFD166";

    ctx.fillText(
      `Mid Energy : ${Math.round(
        mid
      )}`,
      30,
      140
    );

    ctx.fillStyle = "#FF4D9D";

    ctx.fillText(
      `Treble Energy : ${Math.round(
        treble
      )}`,
      30,
      170
    );

    ctx.fillStyle = "#B388FF";

    ctx.fillText(
      `Spectral Centroid : ${Math.round(
        spectralCentroid
      )} Hz`,
      30,
      200
    );

    ctx.fillStyle = "#FF6B6B";

    ctx.fillText(
      `ZCR : ${zcr.toFixed(3)}`,
      30,
      230
    );

    ctx.fillStyle = "#5EEAD4";

    ctx.fillText(
      `RMS : ${rms.toFixed(3)}`,
      30,
      260
    );
  }

  return (

    <div
    style={{
      minHeight: "100vh",
      background:
        "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)",
      padding: "30px",
      fontFamily:
        "'Poppins', sans-serif",
      color: "#1e293b",
    }}
  >

    {/* Header */}
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "20px",
        marginBottom: "25px",
      }}
    >

      <div>

        <h1
          style={{
            fontSize: "38px",
            margin: 0,
            fontWeight: "700",
            color: "#2563eb",
          }}
        >
          Acoustic Spectrum Analyzer
        </h1>

        <p
          style={{
            color: "#64748b",
            marginTop: "8px",
            fontSize: "15px",
          }}
        >
          Real-Time Environmental Audio Analysis using FFT and Gemini AI
        </p>

      </div>

      <button
        onClick={toggle}
        style={{
          padding:
            "14px 24px",
          borderRadius: "12px",
          border: "none",
          background: running
            ? "#ef4444"
            : "#2563eb",
          color: "white",
          fontSize: "15px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "0.3s",
          boxShadow:
            running
              ? "0 6px 18px rgba(239,68,68,0.25)"
              : "0 6px 18px rgba(37,99,235,0.25)",
        }}
      >
        {running
          ? "Stop Analyzer"
          : "Start Analyzer"}
      </button>

    </div>

    {/* Horizontal Info Cards */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "18px",
        marginBottom: "25px",
      }}
    >

      {[
        {
          title: "System Status",
          value: status,
          color: "#2563eb",
        },
        {
          title: "Analysis",
          value: running
            ? "Running"
            : "Stopped",
          color: "#16a34a",
        },
        {
          title: "Audio Input",
          value: "Microphone",
          color: "#9333ea",
        },
        {
          title: "AI Engine",
          value: "Gemini AI",
          color: "#ea580c",
        },
      ].map((item) => (

        <div
          key={item.title}
          style={{
            background: "white",
            borderRadius: "18px",
            padding: "18px",
            border:
              "1px solid #dbeafe",
            boxShadow:
              "0 6px 18px rgba(15,23,42,0.06)",
          }}
        >

          <div
            style={{
              fontSize: "13px",
              color: "#64748b",
              marginBottom: "8px",
            }}
          >
            {item.title}
          </div>

          <div
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: item.color,
            }}
          >
            {item.value}
          </div>

        </div>
      ))}

    </div>

    {/* Spectrum Analyzer */}
    <div
      style={{
        background: "white",
        borderRadius: "22px",
        overflow: "hidden",
        border:
          "1px solid #dbeafe",
        boxShadow:
          "0 10px 25px rgba(15,23,42,0.08)",
        marginBottom: "25px",
      }}
    >

      <div
        style={{
          padding:
            "18px 24px",
          borderBottom:
            "1px solid #e2e8f0",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
        }}
      >

        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            color: "#0f172a",
          }}
        >
          Live Frequency Spectrum
        </h2>

        <div
          style={{
            color: "#2563eb",
            fontWeight: "500",
            fontSize: "14px",
          }}
        >
          FFT Visualization
        </div>

      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          display: "block",
          background:
            "linear-gradient(180deg,#f8fbff,#eef5ff)",
        }}
      />

    </div>

    {/* Gemini AI Response */}
    <div
      style={{
        background: "white",
        borderRadius: "22px",
        padding: "28px",
        border:
          "1px solid #dbeafe",
        boxShadow:
          "0 10px 25px rgba(15,23,42,0.08)",
      }}
    >

      <div
        style={{
          marginBottom: "18px",
          borderBottom:
            "1px solid #e2e8f0",
          paddingBottom: "14px",
        }}
      >

        <h2
          style={{
            margin: 0,
            color: "#1e3a8a",
            fontSize: "26px",
            fontWeight: "700",
          }}
        >
          Gemini AI Analysis Report
        </h2>

        <p
          style={{
            marginTop: "8px",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          AI-generated interpretation of real-time acoustic signals and spectrum characteristics.
        </p>

      </div>

      <div
        style={{
          background: "#f8fafc",
          borderRadius: "16px",
          padding: "24px",
          border:
            "1px solid #e2e8f0",
        }}
      >

        <p
          style={{
            color: "#334155",
            lineHeight: "2",
            fontSize: "15px",
            margin: 0,
            whiteSpace: "pre-wrap",
            textAlign: "justify",
          }}
        >
          {
            geminiAnalysis ||
            "Waiting for Gemini AI response. The system will analyze incoming environmental audio signals and generate a formal acoustic interpretation report."
          }
        </p>

      </div>

    </div>

  </div>
  );
}

export default App;