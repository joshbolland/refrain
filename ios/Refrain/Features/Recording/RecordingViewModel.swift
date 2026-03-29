import SwiftUI
import AVFoundation

@Observable
final class RecordingViewModel {
    // MARK: - State

    var isRecording = false
    var isPaused = false
    var hasRecording = false
    var durationMs: Int = 0
    var audioLevels: [Float] = []
    var showPermissionAlert = false

    var statusText: String {
        if isRecording {
            return "Recording..."
        } else if isPaused {
            return "Paused"
        } else if hasRecording {
            return "Ready to save"
        } else {
            return "Tap to record"
        }
    }

    var formattedDuration: String {
        let totalSeconds = durationMs / 1000
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }

    // MARK: - Private Properties

    private var audioRecorder: AVAudioRecorder?
    private var audioEngine: AVAudioEngine?
    private var recordingURL: URL?
    private var timer: Timer?
    private var levelUpdateTimer: Timer?
    private var startTime: Date?
    private var pausedDuration: TimeInterval = 0

    private let maxLevels = 48
    private let recordingStorageService = RecordingStorageService.shared

    // MARK: - Initialization

    init() {
        audioLevels = Array(repeating: 0, count: maxLevels)
    }

    // MARK: - Permission

    func requestPermission() async {
        let status = AVAudioApplication.shared.recordPermission

        switch status {
        case .undetermined:
            let granted = await AVAudioApplication.requestRecordPermission()
            if !granted {
                await MainActor.run {
                    showPermissionAlert = true
                }
            }
        case .denied:
            await MainActor.run {
                showPermissionAlert = true
            }
        case .granted:
            break
        @unknown default:
            break
        }
    }

    // MARK: - Recording Control

    @MainActor
    func startRecording() async {
        await requestPermission()
        guard AVAudioApplication.shared.recordPermission == .granted else {
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default)
            try session.setActive(true)

            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let fileName = "recording_\(Date().timeIntervalSince1970).m4a"
            recordingURL = documentsPath.appendingPathComponent(fileName)

            guard let url = recordingURL else { return }

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]

            audioRecorder = try AVAudioRecorder(url: url, settings: settings)
            audioRecorder?.isMeteringEnabled = true
            audioRecorder?.prepareToRecord()

            guard audioRecorder?.record() == true else {
                print("Failed to start recording: record() returned false")
                return
            }

            isRecording = true
            isPaused = false
            hasRecording = true
            startTime = Date()

            startTimers()
        } catch {
            print("Failed to start recording: \(error)")
        }
    }

    func pause() {
        audioRecorder?.pause()
        isRecording = false
        isPaused = true
        pausedDuration = Double(durationMs) / 1000.0

        stopTimers()
    }

    func resume() {
        audioRecorder?.record()
        isRecording = true
        isPaused = false
        startTime = Date()

        startTimers()
    }

    func discard() {
        audioRecorder?.stop()
        audioRecorder = nil

        if let url = recordingURL {
            try? FileManager.default.removeItem(at: url)
        }
        recordingURL = nil

        isRecording = false
        isPaused = false
        hasRecording = false
        durationMs = 0
        pausedDuration = 0
        audioLevels = Array(repeating: 0, count: maxLevels)

        stopTimers()
    }

    func save(appState: AppState) async -> Recording? {
        audioRecorder?.stop()
        stopTimers()

        guard let url = recordingURL else { return nil }
        guard let userId = await AuthService.shared.getCurrentUserId() else { return nil }

        let recordingId = UUID().uuidString
        let title = "Recording \(formattedDate())"
        do {
            let storagePath = try await recordingStorageService.uploadRecording(
                from: url,
                recordingId: recordingId,
                userId: userId
            )

            let recording = await appState.createRecording(
                id: recordingId,
                title: title,
                uri: storagePath,
                durationMs: durationMs
            )

            audioRecorder = nil
            recordingURL = nil
            isRecording = false
            isPaused = false
            hasRecording = false
            durationMs = 0
            pausedDuration = 0
            audioLevels = Array(repeating: 0, count: maxLevels)

            return recording
        } catch {
            print("Failed to upload recording: \(error)")
            return nil
        }
    }

    // MARK: - Timer Management

    private func startTimers() {
        // Duration timer
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateDuration()
        }

        // Level update timer
        levelUpdateTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            self?.updateLevels()
        }
    }

    private func stopTimers() {
        timer?.invalidate()
        timer = nil
        levelUpdateTimer?.invalidate()
        levelUpdateTimer = nil
    }

    private func updateDuration() {
        guard let startTime = startTime else { return }
        let elapsed = Date().timeIntervalSince(startTime)
        durationMs = Int((pausedDuration + elapsed) * 1000)
    }

    private func updateLevels() {
        audioRecorder?.updateMeters()
        guard let level = audioRecorder?.averagePower(forChannel: 0) else { return }

        // Convert dB to 0-1 range (assuming -60 dB is silent, 0 dB is max)
        let normalizedLevel = max(0, min(1, (level + 60) / 60))

        // Shift levels and add new one
        audioLevels.removeFirst()
        audioLevels.append(normalizedLevel)
    }

    private func formattedDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: Date())
    }
}
