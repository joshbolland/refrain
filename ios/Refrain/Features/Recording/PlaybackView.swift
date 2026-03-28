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

            // Progress bar
            VStack(spacing: 8) {
                Slider(
                    value: $viewModel.progress,
                    in: 0...1,
                    onEditingChanged: { editing in
                        if !editing {
                            viewModel.seek(to: viewModel.progress)
                        }
                    }
                )
                .tint(Theme.primaryColor)

                HStack {
                    Text(viewModel.formattedCurrentTime)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Spacer()

                    Text(viewModel.formattedRemainingTime)
                        .font(.caption)
                        .foregroundStyle(.secondary)
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
            CollectionsSheet(item: item)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        collectionSheetItem = .recording(recording)
                    } label: {
                        Label("Add to Collection", systemImage: "folder.badge.plus")
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

    private let recording: Recording
    private var audioPlayer: AVAudioPlayer?
    private var timer: Timer?

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
        setupPlayer()
    }

    private func setupPlayer() {
        guard let url = resolvePlaybackURL(from: recording.uri) else {
            print("Failed to setup player: invalid recording URL \(recording.uri)")
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)

            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.delegate = self
            audioPlayer?.prepareToPlay()
            updateProgress()
        } catch {
            print("Failed to setup player: \(error)")
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

    private func resolvePlaybackURL(from uri: String) -> URL? {
        if let url = URL(string: uri), url.isFileURL {
            if FileManager.default.fileExists(atPath: url.path) {
                return url
            }

            let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let candidate = documentsURL.appendingPathComponent(url.lastPathComponent)
            if FileManager.default.fileExists(atPath: candidate.path) {
                return candidate
            }
        }

        if uri.hasPrefix("/") {
            let fileURL = URL(fileURLWithPath: uri)
            if FileManager.default.fileExists(atPath: fileURL.path) {
                return fileURL
            }
        }

        return URL(string: uri)
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
}

#Preview {
    NavigationStack {
        PlaybackView(recording: Recording(
            title: "Test Recording",
            durationMs: 180000,
            uri: ""
        ))
    }
    .environment(AppState())
}
