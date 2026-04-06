import SwiftUI
import AVFoundation

struct PlaybackView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let recording: Recording

    @State private var viewModel: PlaybackViewModel

    @State private var isEditing = false
    @State private var editedTitle: String
    @State private var collectionSheetItem: LibraryItem?
    @FocusState private var isTitleFieldFocused: Bool

    init(recording: Recording) {
        self.recording = recording
        self._viewModel = State(initialValue: PlaybackViewModel(recording: recording))
        self._editedTitle = State(initialValue: recording.title)
    }

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Title
            VStack(spacing: 8) {
                if isEditing {
                    TextField("Title", text: $editedTitle)
                        .font(.title2.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .textFieldStyle(.roundedBorder)
                        .padding(.horizontal, 32)
                        .focused($isTitleFieldFocused)
                        .onSubmit {
                            saveTitle()
                        }
                } else {
                    Text(recording.title)
                        .font(.title2.weight(.semibold))
                }

                Text(recording.formattedDuration)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if !isEditing {
                    beginEditingTitle()
                }
            }

            // Waveform
            VStack(spacing: 8) {
                PlaybackWaveformView(
                    samples: viewModel.waveformSamples,
                    progress: viewModel.progress,
                    isReady: viewModel.isReady
                ) { progress in
                    viewModel.seek(to: progress)
                }

                HStack {
                    Text(viewModel.formattedCurrentTime)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Spacer()

                    Text(viewModel.formattedRemainingTime)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 32)

            Spacer()

            // Playback controls
            HStack(spacing: 48) {
                // Skip backward
                Button {
                    viewModel.skipBackward()
                } label: {
                    Image(systemName: "gobackward.15")
                        .font(.title)
                        .foregroundStyle(.primary)
                }

                // Play/Pause
                Button {
                    if viewModel.isPlaying {
                        viewModel.pause()
                    } else {
                        viewModel.play()
                    }
                } label: {
                    ZStack {
                        Circle()
                            .fill(Theme.primaryColor)
                            .frame(width: 72, height: 72)

                        Image(systemName: viewModel.isPlaying ? "pause.fill" : "play.fill")
                            .font(.title)
                            .foregroundStyle(.white)
                    }
                }
                .disabled(!viewModel.isReady)
                .opacity(viewModel.isReady ? 1 : 0.4)

                // Skip forward
                Button {
                    viewModel.skipForward()
                } label: {
                    Image(systemName: "goforward.15")
                        .font(.title)
                        .foregroundStyle(.primary)
                }
            }

            Spacer()
        }
        .contentShape(Rectangle())
        .onTapGesture {
            dismissTitleEditingIfNeeded()
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $collectionSheetItem) { item in
            ProjectsSheet(item: item)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        collectionSheetItem = .recording(recording)
                    } label: {
                        Label("Add to Project", systemImage: "folder.badge.plus")
                    }

                    Button {
                        beginEditingTitle()
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }

                    Divider()

                    Button(role: .destructive) {
                        Task {
                            await appState.deleteRecording(recording)
                            dismiss()
                        }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .onAppear {
            appState.isTabBarHidden = true
        }
        .task {
            await viewModel.preparePlayback()
        }
        .onChange(of: isEditing) { _, isEditing in
            isTitleFieldFocused = isEditing
        }
        .onDisappear {
            viewModel.stop()
            appState.isTabBarHidden = false
        }
    }

    private func beginEditingTitle() {
        isEditing = true
        isTitleFieldFocused = true
    }

    private func dismissTitleEditingIfNeeded() {
        guard isEditing else { return }
        saveTitle()
        isTitleFieldFocused = false
    }

    private func saveTitle() {
        isEditing = false
        if editedTitle != recording.title {
            var updated = recording
            updated.title = editedTitle
            Task {
                await appState.updateRecording(updated)
            }
        }
    }
}

@Observable
final class PlaybackViewModel: NSObject, AVAudioPlayerDelegate {
    var isPlaying = false
    var progress: Double = 0
    var currentTimeMs: Int = 0
    var isReady = false
    var errorMessage: String?
    var waveformSamples: [Float] = Array(repeating: 0.18, count: 48)

    private let recording: Recording
    private var audioPlayer: AVAudioPlayer?
    private var timer: Timer?
    private let recordingStorageService = RecordingStorageService.shared

    var formattedCurrentTime: String {
        formatTime(ms: currentTimeMs)
    }

    var formattedRemainingTime: String {
        let remaining = recording.durationMs - currentTimeMs
        return "-\(formatTime(ms: remaining))"
    }

    init(recording: Recording) {
        self.recording = recording
        super.init()
    }

    @MainActor
    func preparePlayback() async {
        errorMessage = nil

        do {
            let url = try await recordingStorageService.resolvePlaybackURL(for: recording.uri)
            waveformSamples = await Self.makeWaveformSamples(from: url)
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)

            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.delegate = self
            audioPlayer?.prepareToPlay()
            isReady = true
            updateProgress()
        } catch {
            print("Failed to setup player: \(error)")
            isReady = false
            errorMessage = "Playback unavailable for this recording: \(error.localizedDescription)"
        }
    }

    func play() {
        guard let player = audioPlayer else { return }

        guard player.play() else {
            isPlaying = false
            stopTimer()
            print("Failed to start playback for \(recording.uri)")
            return
        }

        isPlaying = true
        startTimer()
        updateProgress()
    }

    func pause() {
        audioPlayer?.pause()
        isPlaying = false
        stopTimer()
    }

    func stop() {
        audioPlayer?.stop()
        audioPlayer?.currentTime = 0
        isPlaying = false
        stopTimer()
        updateProgress()
    }

    func seek(to progress: Double) {
        guard let player = audioPlayer else { return }
        let time = player.duration * progress
        player.currentTime = time
        updateProgress()
    }

    func skipForward() {
        guard let player = audioPlayer else { return }
        player.currentTime = min(player.duration, player.currentTime + 15)
        updateProgress()
    }

    func skipBackward() {
        guard let player = audioPlayer else { return }
        player.currentTime = max(0, player.currentTime - 15)
        updateProgress()
    }

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateProgress()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func updateProgress() {
        guard let player = audioPlayer else { return }
        guard player.duration > 0 else {
            progress = 0
            currentTimeMs = 0
            return
        }

        progress = player.currentTime / player.duration
        currentTimeMs = Int(player.currentTime * 1000)

        if !player.isPlaying && progress >= 0.99 {
            resetPlaybackState(for: player)
        }
    }

    private func resetPlaybackState(for player: AVAudioPlayer) {
        isPlaying = false
        stopTimer()
        progress = 0
        currentTimeMs = 0
        player.currentTime = 0
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        resetPlaybackState(for: player)
    }

    private func formatTime(ms: Int) -> String {
        let totalSeconds = ms / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    private static func makeWaveformSamples(from url: URL, sampleCount: Int = 48) async -> [Float] {
        await Task.detached(priority: .utility) {
            do {
                let file = try AVAudioFile(forReading: url)
                let frameCount = AVAudioFrameCount(file.length)
                guard frameCount > 0 else {
                    return Array(repeating: 0.18, count: sampleCount)
                }

                guard let buffer = AVAudioPCMBuffer(
                    pcmFormat: file.processingFormat,
                    frameCapacity: frameCount
                ) else {
                    return Array(repeating: 0.18, count: sampleCount)
                }

                try file.read(into: buffer)
                guard let channelData = buffer.floatChannelData?[0] else {
                    return Array(repeating: 0.18, count: sampleCount)
                }

                let totalFrames = Int(buffer.frameLength)
                guard totalFrames > 0 else {
                    return Array(repeating: 0.18, count: sampleCount)
                }

                let framesPerSample = max(totalFrames / sampleCount, 1)
                var samples: [Float] = []
                samples.reserveCapacity(sampleCount)

                var maxAmplitude: Float = 0
                for start in stride(from: 0, to: totalFrames, by: framesPerSample) {
                    let end = min(start + framesPerSample, totalFrames)
                    var peak: Float = 0

                    for frame in start..<end {
                        peak = max(peak, abs(channelData[frame]))
                    }

                    maxAmplitude = max(maxAmplitude, peak)
                    samples.append(peak)
                }

                if samples.count < sampleCount {
                    samples.append(contentsOf: repeatElement(0, count: sampleCount - samples.count))
                } else if samples.count > sampleCount {
                    samples = Array(samples.prefix(sampleCount))
                }

                guard maxAmplitude > 0 else {
                    return Array(repeating: 0.18, count: sampleCount)
                }

                return samples.map { sample in
                    let normalized = sample / maxAmplitude
                    return max(0.12, pow(normalized, 0.65))
                }
            } catch {
                return Array(repeating: 0.18, count: sampleCount)
            }
        }.value
    }
}

private struct PlaybackWaveformView: View {
    let samples: [Float]
    let progress: Double
    let isReady: Bool
    let onSeek: (Double) -> Void

    private let barSpacing: CGFloat = 3

    var body: some View {
        GeometryReader { geometry in
            let count = max(samples.count, 1)
            let totalSpacing = CGFloat(max(count - 1, 0)) * barSpacing
            let barWidth = max((geometry.size.width - totalSpacing) / CGFloat(count), 3)

            HStack(alignment: .center, spacing: barSpacing) {
                ForEach(Array(samples.enumerated()), id: \.offset) { index, sample in
                    RoundedRectangle(cornerRadius: barWidth / 2)
                        .fill(barColor(for: index))
                        .frame(width: barWidth, height: barHeight(for: sample, in: geometry.size.height))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard isReady else { return }
                        onSeek(progress(for: value.location.x, width: geometry.size.width))
                    }
            )
        }
        .frame(height: 96)
    }

    private func barColor(for index: Int) -> Color {
        let threshold = Int((Double(samples.count) * progress).rounded(.down))
        return index < threshold ? Theme.primaryColor : Theme.primaryColor.opacity(0.22)
    }

    private func barHeight(for sample: Float, in height: CGFloat) -> CGFloat {
        max(10, CGFloat(sample) * height)
    }

    private func progress(for x: CGFloat, width: CGFloat) -> Double {
        guard width > 0 else { return 0 }
        return min(max(Double(x / width), 0), 1)
    }
}

#Preview("Playback") {
    NavigationStack {
        PlaybackView(recording: AppState.previewRecording())
    }
    .environment(AppState.preview())
    .environment(\.isPreview, true)
}
