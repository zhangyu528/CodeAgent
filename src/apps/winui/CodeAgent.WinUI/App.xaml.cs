namespace CodeAgent_WinUI;

public partial class App : Microsoft.UI.Xaml.Application
{
    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        var window = new MainWindow();
        window.Activate();
    }
}