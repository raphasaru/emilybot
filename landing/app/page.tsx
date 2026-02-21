import Hero from './components/Hero';
import PainSolution from './components/PainSolution';
import HowItWorks from './components/HowItWorks';
import Formats from './components/Formats';
import SocialProof from './components/SocialProof';
import WaitlistForm from './components/WaitlistForm';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main className="bg-brand-dark text-white min-h-screen">
      <Hero />
      <PainSolution />
      <HowItWorks />
      <Formats />
      <SocialProof />
      <WaitlistForm />
      <Footer />
    </main>
  );
}
