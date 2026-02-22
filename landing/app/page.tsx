import Hero from './components/Hero';
import PainSolution from './components/PainSolution';
import HowItWorks from './components/HowItWorks';
import Formats from './components/Formats';
import SocialProof from './components/SocialProof';
import WaitlistForm from './components/WaitlistForm';
import Footer from './components/Footer';

export default function Home() {
  return (
    <>
      {/* Noise texture overlay */}
      <div className="noise" />


      <main className="relative">
        <Hero />
        <PainSolution />
        <HowItWorks />
        <Formats />
        <SocialProof />
        <WaitlistForm />
      </main>

      <Footer />
    </>
  );
}
